# Установка в Claude Code

Самый быстрый способ — команда `claude mcp add`. После `--` идёт команда запуска сервера как есть.

## Через CLI

Глобально (во всех проектах):

```bash
claude mcp add ozon --scope user -- docker run -i --rm --init --shm-size=1g eduard256/ozon-mcp-server:latest
```

Только в текущем проекте (запишется в `.mcp.json`, можно коммитить в git):

```bash
claude mcp add ozon --scope project -- docker run -i --rm --init --shm-size=1g eduard256/ozon-mcp-server:latest
```

## Вручную через .mcp.json

Файл `.mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "ozon": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"]
    }
  }
}
```

## Проверка

```bash
claude mcp list
```

Сервер с проектным scope требует одобрения при первом запуске `claude` в папке проекта. Подтвердите — появятся три инструмента: `ozon_search`, `ozon_product_details`, `ozon_product_reviews`.

Удалить:

```bash
claude mcp remove ozon
```
