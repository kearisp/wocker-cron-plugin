FROM docker.io/nginxproxy/docker-gen:0.15.0 AS docker-gen

FROM alpine:3.20

ENV TZ=Europe/Kiev

RUN echo "WS_DIR=/app" | tee -a /etc/environment && \
    apk --no-cache add supervisor dcron curl

COPY ./app /app/
COPY --from=docker-gen /usr/local/bin/docker-gen /usr/local/bin/docker-gen
ADD ./usr/bin/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
ADD ./usr/bin/docker-exec /usr/bin/docker-exec

RUN chmod +x /usr/bin/docker-entrypoint.sh && \
    chmod +x /usr/bin/docker-exec

WORKDIR /app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf"]

