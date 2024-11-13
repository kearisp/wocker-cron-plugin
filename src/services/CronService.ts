import {
    Injectable,
    AppConfigService,
    PluginConfigService,
    DockerService,
    FS
} from "@wocker/core";
import {existsSync} from "fs";
import * as Path from "path";
import * as OS from "os";

import {spawn} from "../utils/spawn";


@Injectable()
export class CronService {
    protected _containerName = "cron.ws";
    protected _imageName = "wocker-cron";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    get containerName(): string {
        return this._containerName;
    }

    get imageName(): string {
        return this._imageName;
    }

    get configPath(): string {
        return this.pluginConfigService.dataPath("crontab.json");
    }

    public async start(restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.dockerService.removeContainer(this.containerName);
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            await this.build(rebuild);

            const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                networkMode: "host",
                restart: "always",
                env: {
                    TZ
                },
                volumes: [
                    "/var/run/docker.sock.raw:/var/run/docker.sock:ro",
                    "/var/run/docker.sock.raw:/tmp/docker.sock:ro",
                    `${Path.join(__dirname, "../../plugin/crontab.tmpl")}:/root/app/crontab.tmpl`,
                    `${this.appConfigService.dataPath("ws.log")}:/root/app/ws.log`,
                    `${this.pluginConfigService.dataPath("crontab.json")}:/root/app/crontab.json`
                ]
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }

    public async build(rebuild?: boolean): Promise<void> {
        if(!existsSync(this.pluginConfigService.dataPath("crontab.json"))) {
            await FS.writeJSON(this.pluginConfigService.dataPath("crontab.json"), {});
        }

        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        console.log("Build...");

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin"),
            src: "./Dockerfile"
        });
    }

    public async edit(containerName: string): Promise<void> {
        const path = Path.join(OS.tmpdir(), "ws-crontab.txt");
        const crontab = await this.getCrontab(containerName);

        await FS.writeFile(path, crontab);
        await spawn("nano", [path]);

        const res = await FS.readFile(path);

        if(crontab === res.toString()) {
            return;
        }

        await this.setCrontab(containerName, res.toString());
    }

    public async getCrontab(containerName: string): Promise<string> {
        if(!existsSync(this.configPath)) {
            return "";
        }

        const {
            [containerName]: crontab = ""
        } = await FS.readJSON(this.configPath);

        return crontab;
    }

    public async setCrontab(containerName: string, crontab: string): Promise<void> {
        if(!existsSync(this.configPath)) {
            await FS.writeJSON(this.configPath, {
                [containerName]: crontab
            });

            return;
        }

        await FS.writeJSON(this.configPath, {
            ...await FS.readJSON(this.configPath),
            [containerName]: crontab
        });
    }

    public async logs(): Promise<void> {
        const container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            return;
        }

        await this.dockerService.logs(container);
    }
}
