FROM mysql:8.0

LABEL project="La Mamina" \
      service="database"

# Charset por defecto UTF-8
COPY my.cnf /etc/mysql/conf.d/mamina.cnf

# Schema inicial (solo se ejecuta la primera vez que se crea el volumen)
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql

EXPOSE 3306
