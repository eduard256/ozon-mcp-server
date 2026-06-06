# Установка в VS Code (GitHub Copilot, agent mode)

У VS Code два отличия от остальных: верхний ключ — `servers` (а не `mcpServers`), и нужно поле `"type": "stdio"`.

Нужен VS Code 1.99+ и включённый agent mode у Copilot.

## Путь к файлу

- В проекте: `.vscode/mcp.json` (можно коммитить в git)
- Глобально: палитра команд → `MCP: Open User Configuration`

## Конфигурация

```json
{
  "servers": {
    "ozon": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"]
    }
  }
}
```

После сохранения над блоком сервера появится кнопка Start. Инструменты доступны в Copilot Chat в режиме Agent.
