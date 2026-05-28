import os

def extract_text(file_path: str, filename: str) -> str:
    """
    Extracts plain text content from a file based on its extension.
    Supports PDF (.pdf), DOCX (.docx), XLSX (.xlsx), and plain text (.txt, .md, .csv, etc.).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")
        
    ext = os.path.splitext(filename.lower())[1]
    
    try:
        # 1. PDF Documents
        if ext == ".pdf":
            import PyPDF2
            text = ""
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            return text
            
        # 2. DOCX Word Documents
        elif ext == ".docx":
            import docx
            doc = docx.Document(file_path)
            paragraphs = [para.text for para in doc.paragraphs]
            return "\n".join(paragraphs)
            
        # 3. XLSX Excel Spreadsheets
        elif ext in (".xlsx", ".xls"):
            import openpyxl
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            lines = []
            for sheet in wb.worksheets:
                lines.append(f"--- Sheet: {sheet.title} ---")
                for row in sheet.iter_rows(values_only=True):
                    if any(row):  # Skip completely empty rows
                        row_str = ", ".join([str(cell) if cell is not None else "" for cell in row])
                        lines.append(row_str)
            return "\n".join(lines)
            
        # 4. Text and Markdown (Fallback)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
                
    except Exception as e:
        raise ValueError(f"Error parsing file '{filename}': {str(e)}")
