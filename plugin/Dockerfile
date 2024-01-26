FROM ubuntu:latest

RUN apt-get update && \
    apt-get -y install cron wget curl unzip

RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

RUN ln -s /proc/1/fd/1 /var/log/cron.log

ADD ./bin/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

ADD ./bin/test.sh /root/test.sh
RUN chmod 0644 /root/test.sh

COPY ./plugin /root/app

RUN { \
        cat; \
        echo "* * * * * bash /root/test.sh 'Cron' >> /var/log/cron.log 2>> /var/log/cron.log"; \
    } | crontab -
RUN crontab -l

VOLUME ["/var/run/docker.sock"]
WORKDIR /root/app

ENTRYPOINT ["/entrypoint.sh"]
CMD ["cron", "-f"]
