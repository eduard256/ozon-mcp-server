# Установка в Windsurf

## Путь к файлу

- macOS/Linux: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

Открыть через интерфейс: панель Cascade → иконка MCP справа вверху → Configure.

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

После сохранения нажмите Refresh в панели MCP. Windsurf поддерживает подстановку `${env:ИМЯ_ПЕРЕМЕННОЙ}` в полях `command`, `args`, `env`.
