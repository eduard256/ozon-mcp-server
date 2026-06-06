# Установка в Continue.dev

У Continue свой формат: предпочтительно YAML, серверы заданы списком, у каждого поле `name`.

## Путь к файлу

- Глобально (YAML, рекомендуется): `~/.continue/config.yaml`
- Глобально (JSON, устаревший): `~/.continue/config.json`
- В проекте: `.continue/mcpServers/mcp.json`

## Конфигурация (YAML)

```yaml
mcpServers:
  - name: ozon
    command: docker
    args:
      - run
      - -i
      - --rm
      - --init
      - --shm-size=1g
      - eduard256/ozon-mcp-server:latest
```

## Конфигурация (JSON, устаревший формат)

```json
{
  "mcpServers": [
    {
      "name": "ozon",
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"]
    }
  ]
}
```

Серверы здесь — массив, а не объект с ключами. Поле `name` обязательно.
