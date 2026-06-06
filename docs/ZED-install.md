# Установка в Zed

У Zed верхний ключ — `context_servers` (а не `mcpServers`), всё в общем `settings.json`.

## Путь к файлу

- macOS/Linux: `~/.config/zed/settings.json`
- Windows: `%APPDATA%\Zed\settings.json`

## Конфигурация

```json
{
  "context_servers": {
    "ozon": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"],
      "env": {}
    }
  }
}
```

Если в `settings.json` уже есть другие ключи — добавьте `context_servers` к ним, не заменяя файл целиком.

Статус: Agent Panel → настройки → зелёная точка значит сервер активен. Права на инструменты задаются в формате `mcp:ozon:<имя_инструмента>`.
