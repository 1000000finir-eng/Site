import sys, re, difflib
sys.argv_backup = sys.argv
from importlib.machinery import SourceFileLoader
import types
src = open('tools/compare.py').read().split("orig, built")[0]
ns = {}; exec(src, ns)
A, B = ns['norm'](sys.argv[1]), ns['norm'](sys.argv[2])
sm = difflib.SequenceMatcher(None, A, B, autojunk=False)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal': continue
    print(f'{tag} orig[{i1}:{i2}] built[{j1}:{j2}]')
    for x in A[i1:min(i2, i1 + 3)]: print('   -', x[:150])
    for x in B[j1:min(j2, j1 + 3)]: print('   +', x[:150])
    if i2 - i1 > 3: print(f'   - … ещё {i2 - i1 - 3}')
