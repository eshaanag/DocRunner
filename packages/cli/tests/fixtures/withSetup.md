# File Setup

<!-- docrunner: setup -->

```python
from pathlib import Path
Path("message.txt").write_text("ready")
```

<!-- docrunner: name="Read generated message" -->

```py
from pathlib import Path
assert Path("message.txt").read_text() == "ready"
```

## Manual Escape Hatch

<!-- docrunner: skip -->

```javascript
connectToProductionService();
```
