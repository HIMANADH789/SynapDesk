"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { Document } from "@/types";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const res = await api.listDocuments();
      setDocuments(res.documents);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      await api.uploadDocument(file);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.deleteDocument(docId);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          {uploading ? "Uploading..." : "Upload File"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg">No documents uploaded yet</p>
            <p className="mt-2 text-sm">
              Upload PDF, DOCX, or TXT files to build your knowledge base
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm font-medium text-gray-500">
                <th className="px-6 py-4">File Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Chunks</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Uploaded</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.doc_id}
                  className="border-b border-gray-50 text-sm"
                >
                  <td className="px-6 py-4 font-medium">{doc.filename}</td>
                  <td className="px-6 py-4 uppercase text-gray-500">
                    {doc.file_type}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {doc.chunks_count}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        doc.status === "ready"
                          ? "bg-green-100 text-green-700"
                          : doc.status === "processing"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(doc.doc_id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
