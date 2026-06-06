# Установка в Cursor

## Путь к файлу

- Глобально: `~/.cursor/mcp.json`
- В проекте: `.cursor/mcp.json`

Открыть через интерфейс: Cursor Settings → Tools & MCP → New MCP Server.

## Конфигурация

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

Поле `"type": "stdio"` указывать не нужно — оно определяется автоматически при наличии `command`.

После сохранения сервер появится в списке в Settings → Tools & MCP с зелёным индикатором.
