FROM nginxproxy/nginx-proxy

ENV WS_DIR='/root/app' TZ=Europe/Kiev

WORKDIR $WS_DIR

RUN echo "WS_DIR=${WS_DIR}" | tee -a /etc/environment
RUN apt-get update && \
    apt-get -y --fix-missing install cron curl

ADD ./bin/entrypoint.sh /entrypoint-cron.sh
ADD ./bin/docker-exec /usr/bin/docker-exec
ADD ./Procfile /root/app/Procfile
ADD ./crontab.tmpl /root/app/crontab.tmpl

RUN chmod +x /entrypoint-cron.sh && \
    chmod +x /usr/bin/docker-exec

ENTRYPOINT ["/entrypoint-cron.sh"]
CMD ["forego", "start", "-r"]
