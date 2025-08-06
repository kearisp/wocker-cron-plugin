FROM docker.io/nginxproxy/docker-gen:0.15.0 AS docker-gen

FROM docker.io/nginxproxy/forego:0.18.3 AS forego

FROM alpine:3.20

ENV WS_DIR='/app' TZ=Europe/Kiev

RUN echo "WS_DIR=${WS_DIR}" | tee -a /etc/environment && \
    apk --no-cache add dcron curl

COPY ./app /app/
COPY --from=forego /usr/local/bin/forego /usr/local/bin/forego
COPY --from=docker-gen /usr/local/bin/docker-gen /usr/local/bin/docker-gen
ADD ./usr/bin/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
ADD ./usr/bin/docker-exec /usr/bin/docker-exec

RUN chmod +x /usr/bin/docker-entrypoint.sh && \
    chmod +x /usr/bin/docker-exec

WORKDIR /app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["forego", "start", "-r"]
