from google import genai

client = genai.Client(api_key="AIzaSyA1nGXabW4AXVCYVVnv8esxluBejty2JfE")

for m in client.models.list():
    print(m.name)