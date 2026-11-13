import sys,io
def patch(path, pairs):
    s=open(path,encoding='utf-8').read()
    for a,b,*cnt in pairs:
        n = s.count(a)
        want = cnt[0] if cnt else 1
        if n < 1 or (want != -1 and n != want):
            print('!! %s: expected %s got %d for: %r' % (path, want, n, a[:70])); sys.exit(1)
        s=s.replace(a,b)
    open(path,'w',encoding='utf-8',newline='\n').write(s)
    print('patched', path, len(pairs))
