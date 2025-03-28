import { NovitaSDK, TaskStatus } from "novita-sdk";
import { NOVITA_API_KEY } from "./constants";

const novita_key: string = NOVITA_API_KEY!;
const novitaClient = new NovitaSDK(novita_key);

function formParams(prompt: string, model_name: string, sampler_name: string): any {
    const params = {
        request: {
            model_name: model_name,
            prompt: prompt,
            negative_prompt: "",
            width: 512,
            height: 512,
            sampler_name: sampler_name,
            guidance_scale: 7.5,
            steps: 20,
            image_num: 1,
            clip_skip: 1,
            seed: -1,
            loras: [],
        }
    }
    return params;
}

export async function generateImage(prompt: string, model_name: string, sampler_name: string, onFinish: (images: string) => void) {
    const params = formParams(prompt, model_name, sampler_name); 

    novitaClient.txt2Img(params)
        .then((res: any) => {
            if (res && res.task_id) {
                const timer = setInterval(() => {
                    novitaClient.progress({
                        task_id: res.task_id,
                    })
                        .then((progressRes: any) => {
                            if (progressRes.task.status === TaskStatus.SUCCEED) {
                                console.log("finished!", progressRes.images);
                                clearInterval(timer);
                                onFinish(progressRes.images[0]); // guessing the return is a url from which the image can be downloaded
                            }
                            if (progressRes.task.status === TaskStatus.FAILED) {
                                console.warn("failed!", progressRes.task.reason);
                                clearInterval(timer);
                            }
                            if (progressRes.task.status === TaskStatus.QUEUED) {
                                console.log("queueing");
                            }
                        })
                        .catch((err: any) => {
                            console.error("progress error:", err);
                        })
                }, 1000);
            }
        })
        .catch((err: any) => {
            console.error("txt2Img error:", err);
        })
}


export function getModelName(): string {
    const modelNames = [
        "realisticAfmix_realisticAfmix_75178.safetensors",
        "CheckpointYesmix_v16.safetensors",
        "hassakuHentaiModel_v13_75289.safetensors",
        "lawlassYiffymix20Furry_lawlasmixWithBakedIn_13264.safetensors",
        "mistoonAnime_v20_76550.safetensors"
    ];
    return modelNames[Math.floor(Math.random() * modelNames.length)];
}

export function getSamplerName(): string {
    return "DPM++ 2S a Karras";
}

