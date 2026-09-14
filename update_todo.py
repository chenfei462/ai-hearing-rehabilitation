with open('TODO.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Mark Task 6 as completed
content = content.replace('- [ ] Task 6: 修复对话API IDOR漏洞 (P1)', '- [x] Task 6: 修复对话API IDOR漏洞 (P1)')

# Update verification checklist
content = content.replace('- [ ] 对话API IDOR：用户无法访问他人session', '- [x] 对话API IDOR：用户无法访问他人session')

with open('TODO.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated TODO.md')
