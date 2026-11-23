#!/usr/bin/env python3
import sys, zipfile, io

def patch_zpk(input_path, output_path, api_key):
    with open(input_path, 'rb') as f:
        data = f.read()
    
    in_outer = zipfile.ZipFile(io.BytesIO(data))
    out_outer_buf = io.BytesIO()
    out_outer = zipfile.ZipFile(out_outer_buf, 'w', zipfile.ZIP_DEFLATED)
    
    for item in in_outer.infolist():
        item_data = in_outer.read(item.filename)
        if item.filename == 'app-side.zip':
            in_inner = zipfile.ZipFile(io.BytesIO(item_data))
            out_inner_buf = io.BytesIO()
            out_inner = zipfile.ZipFile(out_inner_buf, 'w', zipfile.ZIP_DEFLATED)
            for inner_item in in_inner.infolist():
                inner_data = in_inner.read(inner_item.filename)
                if inner_item.filename == 'app-side.js':
                    inner_text = inner_data.decode('utf-8', errors='replace')
                    inner_text = inner_text.replace('YOUR_GEMINI_API_KEY', api_key)
                    inner_data = inner_text.encode('utf-8')
                out_inner.writestr(inner_item, inner_data)
            out_inner.close()
            item_data = out_inner_buf.getvalue()
        out_outer.writestr(item, item_data)
    out_outer.close()
    
    with open(output_path, 'wb') as f:
        f.write(out_outer_buf.getvalue())

if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(1)
    patch_zpk(sys.argv[1], sys.argv[2], sys.argv[3])
