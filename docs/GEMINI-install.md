# Установка в Gemini CLI

## Путь к файлу

- Глобально: `~/.gemini/settings.json`
- В проекте: `.gemini/settings.json`

## Конфигурация

```json
{
  "mcpServers": {
    "ozon": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"],
      "timeout": 30000,
      "trust": false
    }
  }
}
```

`trust: false` — Gemini спросит подтверждение перед вызовом инструмента. Поставьте `true`, чтобы вызывать без подтверждения. `timeout` — в миллисекундах.

## Через CLI

```bash
gemini mcp add ozon -- docker run -i --rm --init --shm-size=1g eduard256/ozon-mcp-server:latest
```
