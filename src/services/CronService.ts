import {
    Injectable,
    AppConfigService,
    PluginConfigService,
    DockerService,
    FileSystem
} from "@wocker/core";
import * as Path from "path";
import * as OS from "os";
import {spawn} from "../utils/spawn";


@Injectable()
export class CronService {
    protected _containerName = "wocker-cron";
    protected oldContainerNames: string[] = [
        "cron.ws"
    ];
    protected _imageName = "wocker-cron:1.0.11";
    protected oldImages: string[] = [
        "wocker-cron:latest",
        "wocker-cron:1.0.9",
        "wocker-cron:1.0.10"
    ];

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public get containerName(): string {
        return this._containerName;
    }

    public get imageName(): string {
        return this._imageName;
    }

    public async start(restart?: boolean, rebuild?: boolean): Promise<void> {
        for(const containerName of this.oldContainerNames) {
            await this.dockerService.removeContainer(containerName);
        }

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
                    `${Path.join(__dirname, "../../plugin/usr/bin/docker-exec")}:/usr/bin/docker-exec`,
                    `${this.appConfigService.fs.path("ws.log")}:/app/ws.log`,
                    `${this.fs.path("crontab.json")}:/app/crontab.json`
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
        for(const image of this.oldImages) {
            await this.dockerService.imageRm(image);
        }

        if(!this.fs.exists("crontab.json")) {
            this.fs.writeJSON("crontab.json", {});
        }

        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        console.info("Build...");

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin"),
            src: "./Dockerfile"
        });
    }

    public async edit(containerName: string): Promise<void> {
        const tmp = new FileSystem(OS.tmpdir());
        const crontab = await this.getCrontab(containerName);

        tmp.writeFile("ws-crontab.txt", crontab);

        await spawn("nano", [tmp.path("ws-crontab.txt")]);

        const res = tmp.readFile("ws-crontab.txt");

        if(crontab === res.toString()) {
            return;
        }

        await this.setCrontab(containerName, res.toString());
    }

    public async getCrontab(containerName: string): Promise<string> {
        if(!this.fs.exists("crontab.json")) {
            return "";
        }

        const {
            [containerName]: crontab = ""
        } = this.fs.readJSON("crontab.json");

        return crontab;
    }

    public async setCrontab(containerName: string, crontab: string): Promise<void> {
        if(!this.fs.exists("crontab.json")) {
            this.fs.writeJSON("crontab.json", {
                [containerName]: crontab
            });
            return;
        }

        this.fs.writeJSON("crontab.json", {
            ...this.fs.readJSON("crontab.json"),
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
