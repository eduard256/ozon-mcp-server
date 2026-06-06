# Установка в OpenAI Codex CLI

Codex использует формат TOML, а не JSON. Это единственный клиент с таким отличием.

## Путь к файлу

- Глобально: `~/.codex/config.toml`
- В проекте: `.codex/config.toml`

## Конфигурация

```toml
[mcp_servers.ozon]
command = "docker"
args = ["run", "-i", "--rm", "--init", "--shm-size=1g", "eduard256/ozon-mcp-server:latest"]
# startup_timeout_sec = 30   # поднимите, если docker долго тянет образ
```

## Через CLI

```bash
codex mcp add ozon -- docker run -i --rm --init --shm-size=1g eduard256/ozon-mcp-server:latest
```

## Проверка

```bash
codex mcp list
```

В некоторых версиях Codex не подхватывает `mcp_servers` из `config.toml` сразу. Если сервера нет в списке — перезапустите Codex или запустите с `codex --mcp-debug`.
