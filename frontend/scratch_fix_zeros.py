import re

with open('src/components/gstr3b/GSTR3BPreparedModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace direct >0.00<
content = re.sub(r'>0\.00<', r'>{renderCell("0.00")}<', content)

# Replace conditions like >{i !== 2 && i !== 4 ? "0.00" : ""}<
content = re.sub(r'>({\s*[^{}>]+?\?[^{}>]+?:[^{}>]+?})<', lambda m: ">{" + f"renderCell({m.group(1)[1:-1]})" + "}<", content)

with open('src/components/gstr3b/GSTR3BPreparedModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
