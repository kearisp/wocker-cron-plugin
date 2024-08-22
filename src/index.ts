import {Plugin, PluginConfigService} from "@wocker/core";

import {CronController} from "./controllers/CronController";
import {CronService} from "./services/CronService";


@Plugin({
    name: "cron",
    controllers: [
        CronController
    ],
    providers: [
        PluginConfigService,
        CronService
    ]
})
export default class CronModule {}
