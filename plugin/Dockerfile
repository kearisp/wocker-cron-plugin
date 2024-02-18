FROM ubuntu:latest

ENV WS_DIR='/root/app'
RUN echo "WS_DIR=${WS_DIR}" | tee -a /etc/environment
WORKDIR $WS_DIR

RUN apt-get update && \
    apt-get -y --fix-missing install cron curl

RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @wocker/cron

RUN { \
        cat; \
        echo "* * * * * ws-cron exec echo \"No jobs\""; \
    } | crontab -

ADD ./bin/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["ws-cron", "process"]
