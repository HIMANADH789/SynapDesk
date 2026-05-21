import re

with open("vnr_script.js", "r", encoding="utf-8") as f:
    content = f.read()

# Remove backslashes before backticks and dollar signs
content = content.replace(r"\`", "`")
content = content.replace(r"\$", "$")

with open("vnr_script.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Unescaped script successfully.")
