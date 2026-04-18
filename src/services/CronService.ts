import {
    Injectable,
    AppService,
    PluginConfigService,
    DockerService,
    FileSystem
} from "@wocker/core";
import * as Path from "path";
import * as OS from "os";
import {CrontabEditor} from "../makes";
import {spawn} from "../utils/spawn";


@Injectable()
export class CronService {
    protected readonly name = "cron";
    protected readonly version = "1.0.15";
    protected readonly oldContainerNames: string[] = [
        "cron.ws"
    ];
    protected readonly oldImages: string[] = [
        "wocker-cron:latest",
        "wocker-cron:1.0.9",
        "wocker-cron:1.0.10",
        "wocker-cron:1.0.11",
        "wocker-cron:1.0.12",
        "wocker-cron:1.0.13"
    ];

    public constructor(
        protected readonly appService: AppService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public get containerName(): string {
        return "wocker-cron";
    }

    public get imageName(): string {
        return `wocker-cron:${this.version}`;
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
                    "/var/run/docker.sock:/var/run/docker.sock:ro",
                    `${this.appService.fs.path("ws.log")}:/app/ws.log`,
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
            console.info("Cron started");
        }
    }

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }

    public async build(rebuild?: boolean): Promise<void> {
        for(const image of this.oldImages) {
            await this.dockerService.imageRm(image);
        }

        const images = await this.dockerService.imageLs({
            labels: {
                "wocker.name": this.name,
                "wocker.type": "service"
            }
        });

        for(const image of images) {
            if(
                image.Labels["wocker.type"] === "service" &&
                image.Labels["wocker.name"] === this.name &&
                image.Labels["wocker.version"] !== this.version &&
                image.RepoTags?.[0]
            ) {
                await this.dockerService.imageRm(image.RepoTags[0]);
            }
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

        console.info(`Building ${this.imageName}...`);

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../../plugin"),
            src: "./Dockerfile",
            labels: {
                "wocker.name": this.name,
                "wocker.version": this.version,
                "wocker.type": "service"
            }
        });
    }

    public async edit(containerName: string): Promise<void> {
        const tmp = new FileSystem(OS.tmpdir());
        const crontab = this.getCrontab(containerName);

        tmp.writeFile("ws-crontab.txt", crontab);

        const editor = process.env.VISUAL || process.env.EDITOR || "nano";
        await spawn(editor, [tmp.path("ws-crontab.txt")]);

        const res = tmp.readFile("ws-crontab.txt");

        if(crontab === res.toString()) {
            return;
        }

        this.setCrontab(containerName, res.toString());

        const stream = await this.dockerService.exec(this.containerName, ["supervisorctl", "restart", "docker-gen"]);

        if(!stream) {
            return;
        }

        console.info("Restarting...");

        this.dockerService.docker.modem.demuxStream(stream, process.stdout, process.stderr);
    }

    public getCrontab(containerName: string): string {
        if(!this.fs.exists("crontab.json")) {
            return "";
        }

        const {
            [containerName]: crontab = ""
        } = this.fs.readJSON("crontab.json");

        return crontab;
    }

    public setCrontab(containerName: string, crontab: string): void {
        const c = new CrontabEditor(crontab);

        const data = this.fs.exists("crontab.json")
            ? this.fs.readJSON("crontab.json")
            : {};

        this.fs.writeJSON("crontab.json", {
            ...data,
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
