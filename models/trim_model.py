import os
import sys

def valid_word(word, file_path):
    with open(file_path, 'r') as iFile:
        contentRef = iFile.read().splitlines()
        if word in contentRef:
            return True
    return False

if len(sys.argv) != 3:
    print("Usage:\t" + sys.argv[0] + " wordlist.txt model.bin\nwordlist.txt contains the list of valid words, model.bin is the model to strip.\nIt will output a model_stripped.bin file.", file=sys.stderr)
    sys.exit(1)

if os.path.exists(sys.argv[1]) == False:
    print('Cannot find: ' + sys.argv[1], file=sys.stderr)
    sys.exit(1)
if os.path.exists(sys.argv[2]) == False:
    print('Cannot find: ' + sys.argv[2], file=sys.stderr)
    sys.exit(1)
if len(sys.argv[2]) <= len('.bin') or sys.argv[2][len(sys.argv[2]) - len('.bin'):] != '.bin':
    print('Extension must be `.bin`: ' + sys.argv[2], file=sys.stderr)
    sys.exit(1)

sName = sys.argv[2][:len(sys.argv[2]) - len('.bin')]
os.system('~/convertvec bin2txt ' + sys.argv[2] + ' ' + sName + '.txt')
with open(sName + '.txt', 'r', encoding='utf-8', errors='replace') as f:
    count = 0
    dimension = f.readline().split(' ')[1]
    with open(sName + '_stripped.txt', 'w') as oFile:
        #oFile.write(f.readline())
        for line in f:
            word = line.split(' ')[0]
            if valid_word(word, sys.argv[1]):
                oFile.write(line)
                count += 1
    # Prepend: lines&dimension (1st line)
    with open(sName + '_stripped.txt', 'r+') as oFile:
        file_text = oFile.read()
        oFile.seek(0)
        oFile.write(str(count) + ' ' + str(dimension) + file_text)
os.remove(sName + '.txt')
os.system('~/convertvec txt2bin ' + sName + '_stripped.txt ' + sName + '_stripped.bin')
os.remove(sName + '_stripped.txt')
if os.path.exists(sName + '_stripped.bin'):
    print('Success!')
