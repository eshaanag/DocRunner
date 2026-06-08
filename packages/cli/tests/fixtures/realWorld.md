# Real-World Library Examples

## FastAPI Application

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

## HTTPX Request

<!-- docrunner: skip -->

```python
import httpx

response = httpx.get("https://www.example.org/")
response.raise_for_status()
```

## Rich Console Markup

```py
from rich import print

print("[bold magenta]Documentation[/bold magenta] is executable.")
```
