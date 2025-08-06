#!/bin/sh

ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
#crontab -r
#crond -d -f -l 8 &
exec "$@"
