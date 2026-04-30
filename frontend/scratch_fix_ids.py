import re

with open('src/components/gstr3b/GSTR3BPreparedModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

def repl(m):
    repl.counter += 1
    # Check if there's already a cell id, like renderCell("0.00", "cell_id_XX")
    # If not, add one
    inner = m.group(1)
    if ', "cell_id_' in inner:
        return m.group(0) # Do nothing
    return f'renderCell({inner}, "{inner.strip()}-" + i + "-cell_id_{repl.counter}")'

repl.counter = 0

# Only replace renderCell calls. Careful about nested parens.
# The regex renderCell\(([^()]+|(?:\([^()]*\)))+\) handles up to 1 level of nested parentheses.
content = re.sub(r'renderCell\(([^()]+|\([^()]*\))+\)', repl, content)

with open('src/components/gstr3b/GSTR3BPreparedModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
