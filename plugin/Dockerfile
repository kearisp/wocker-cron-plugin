FROM ubuntu:latest

RUN apt-get update && \
    apt-get -y --fix-missing install cron curl

#ARG NODE_VERSION="18.16.0"
#ENV NVM_DIR=/root/.nvm

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @wocker/cron

#RUN if [ "$NODE_VERSION" != "" ] && [ "$NODE_VERSION" != "none" ]; then \
#        mkdir -p $NVM_DIR; \
#        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash; \
#        . "$NVM_DIR/nvm.sh" && \
#            nvm install $NODE_VERSION && \
#            nvm alias default $NODE_VERSION && \
#            nvm use default; echo "[ -n \"\$(command -v npm)\" ] && . <(npm completion)" >> /.bashrc && \
#            npm install -g @wocker/cron; \
#    fi

RUN ln -s /proc/1/fd/1 /var/log/cron.log

ADD ./bin/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

ADD ./bin/default.sh /root/default.sh
RUN chmod 0644 /root/default.sh

RUN { \
        cat; \
        echo "* * * * * bash /root/default.sh 'No cron jobs' >> /var/log/cron.log 2>> /var/log/cron.log"; \
    } | crontab -
RUN crontab -l

VOLUME ["/var/run/docker.sock"]
WORKDIR /root/app

ENTRYPOINT ["/entrypoint.sh"]
#CMD ["cron", "-f"]
CMD ["ws-cron", "watch"]
