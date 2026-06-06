# Установка в Claude Desktop

## Путь к файлу конфигурации

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Открыть можно через Settings → Developer → Edit Config.

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

Если в файле уже есть другие серверы — добавьте `ozon` внутрь существующего блока `mcpServers`, не создавайте второй.

## После сохранения

Полностью перезапустите Claude Desktop. Горячей перезагрузки нет — закройте приложение целиком и откройте заново.

Иконка инструментов (молоток) в окне ввода покажет три инструмента: `ozon_search`, `ozon_product_details`, `ozon_product_reviews`.
