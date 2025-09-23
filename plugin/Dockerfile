FROM docker.io/nginxproxy/docker-gen:0.15.0 AS docker-gen

FROM alpine:3.20

ENV TZ=Etc/UTC
ENV WS_DIR=/app

COPY --from=docker-gen /usr/local/bin/docker-gen /usr/local/bin/docker-gen
ADD ./usr/bin/docker-exec /usr/bin/docker-exec
COPY ./app /app/

RUN apk --no-cache add supervisor dcron curl tzdata && \
    chmod +x /usr/bin/docker-exec

WORKDIR /app

CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf"]

