import asyncio
import os
import urllib.request
import numpy as np
from functools import partial
import logging

from app.providers.base import EmbeddingProvider

logger = logging.getLogger(__name__)


class HuggingFaceEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Uses ONNX Runtime instead of sentence-transformers/PyTorch to stay within 
        low memory limits (e.g. Render 512MB RAM tier).
        """
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self._dimension = 384
        
        # Path to store the lightweight ONNX models
        model_dir = os.path.join(os.path.dirname(__file__), "model_onnx")
        os.makedirs(model_dir, exist_ok=True)
        
        model_path = os.path.join(model_dir, "model.onnx")
        tokenizer_path = os.path.join(model_dir, "tokenizer.json")
        
        # Auto-download from Hugging Face if missing (useful for local development)
        if not os.path.exists(model_path):
            logger.info(f"Downloading ONNX model weights to {model_path}...")
            urllib.request.urlretrieve(
                "https://huggingface.co/optimum/all-MiniLM-L6-v2/resolve/main/model.onnx", 
                model_path
            )
            
        if not os.path.exists(tokenizer_path):
            logger.info(f"Downloading ONNX tokenizer to {tokenizer_path}...")
            urllib.request.urlretrieve(
                "https://huggingface.co/optimum/all-MiniLM-L6-v2/resolve/main/tokenizer.json", 
                tokenizer_path
            )

        # Load lightweight Hugging Face tokenizer and ONNX graph
        self.tokenizer = Tokenizer.from_file(tokenizer_path)
        self.tokenizer.enable_padding(length=128, pad_token="[PAD]")
        self.tokenizer.enable_truncation(max_length=128)
        
        # Load ONNX model into CPU session
        self.session = ort.InferenceSession(model_path)
        logger.info("ONNX Embedding Provider initialized successfully.")

    def _embed_texts_sync(self, texts: list[str]) -> list[list[float]]:
        embeddings = []
        for text in texts:
            # Tokenize input string
            encoded = self.tokenizer.encode(text)
            input_ids = np.array([encoded.ids], dtype=np.int64)
            attention_mask = np.array([encoded.attention_mask], dtype=np.int64)
            token_type_ids = np.array([encoded.type_ids], dtype=np.int64)

            # Run ONNX inference
            inputs = {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids
            }
            outputs = self.session.run(None, inputs)
            
            # Mean pooling over token embeddings
            last_hidden_state = outputs[0]
            input_mask_expanded = np.expand_dims(attention_mask, -1).astype(float)
            sum_embeddings = np.sum(last_hidden_state * input_mask_expanded, axis=1)
            sum_mask = np.clip(input_mask_expanded.sum(axis=1), a_min=1e-9, a_max=None)
            embedding = (sum_embeddings / sum_mask)[0]
            
            # Normalize vector to unit length
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
                
            embeddings.append(embedding.tolist())
            
        return embeddings

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None, partial(self._embed_texts_sync, texts)
        )
        return embeddings

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0]

    def get_dimension(self) -> int:
        return self._dimension
