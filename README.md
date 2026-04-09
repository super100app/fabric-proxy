# Fabric SQL Proxy

Proxy HTTP que conecta ao Microsoft Fabric SQL via TDS (porta 1433).
Deploy no Railway para usar como ponte entre Edge Functions e o Data Warehouse.

## Deploy no Railway

1. Conecte este repo ao Railway
2. Adicione a variável de ambiente: `PROXY_SECRET` (uma senha qualquer para proteger o proxy)
3. Railway faz deploy automático

## Uso

POST para a URL do Railway com:
```json
{
  "host": "seu-servidor.datawarehouse.fabric.microsoft.com",
  "database": "seu-database",
  "user": "usuario@dominio.com",
  "password": "senha",
  "query": "SELECT TOP 10 * FROM tabela"
}
