FROM postgres:15

CMD sh -c "\
echo '===================================='; \
echo '📦 PostgreSQL Ready'; \
echo '🔗 Connect using:'; \
echo 'Host: localhost'; \
echo 'Port: 5432'; \
echo 'DB: inventory'; \
echo 'User: postgres'; \
echo 'Password: password'; \
echo '===================================='; \
exec docker-entrypoint.sh postgres \
"
