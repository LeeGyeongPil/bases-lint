# Dashboard

A base block inside a note is checked the same way as a .base file.

```base
filters: file.hasTag("book")
views:
  - type: cards
    name: Books
    order: [file.name, rating]
```
