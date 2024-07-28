import {Button, Checkbox, Radio, Select, Stack, TextInput} from "@mantine/core";
import {useStore} from "@nanostores/react";
import {$bold, $cvLoaded, $font, $italic, $mesh, $reductionStrategy, $textA, $textB} from "../../store.ts";
import {useCallback} from "react";
import {download} from "../../scripts/jscad.ts";
import {ReductionStrategy} from "../../types.ts";

const defaultFonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier',
    'Verdana',
    'Georgia',
    'Palatino',
    'Garamond',
    'Bookman',
    'Comic Sans MS',
    'Trebuchet MS',
    'Arial Black',
    'Impact'
];

interface FormGenerateProps {
    onGenerate: () => void;
}

function FormGenerate({onGenerate}: FormGenerateProps) {
    const textA = useStore($textA)
    const textB = useStore($textB)
    const font = useStore($font)
    const bold = useStore($bold)
    const italic = useStore($italic)
    const mesh = useStore($mesh);
    const cvLoaded = useStore($cvLoaded);
    const reductionStrategy = useStore($reductionStrategy);

    const onFont = useCallback((option: string | null) => {
        if (option !== null) {
            $font.set(option)
        }
    }, [])

    const downloadMesh = useCallback(() => {
        const mesh = $mesh.get();
        const name = $textA.get().toLowerCase() + "_" + $textB.get().toLowerCase();
        download(mesh, name);
    }, []);

    return <Stack>
        <TextInput
            label="Side A text"
            placeholder="right side text"
            value={textB}
            onChange={(event) => $textB.set(event.currentTarget.value)}
            styles={() => ({
                input: {
                    fontFamily: font,
                    fontWeight: bold ? 'bold' : 'normal',
                    fontStyle: italic ? 'italic' : 'normal',
                },
            })}
        />
        <TextInput
            label="Side B text"
            placeholder="left side text"
            value={textA}
            onChange={(event) => $textA.set(event.currentTarget.value)}
            styles={() => ({
                input: {
                    fontFamily: font,
                    fontWeight: bold ? 'bold' : 'normal',
                    fontStyle: italic ? 'italic' : 'normal',
                },
            })}
        />
        <Select
            label="Font"
            placeholder="Pick value"
            data={defaultFonts}
            value={font}
            onChange={onFont}
        />
        <Checkbox
            label="Bold"
            value={bold}
            onChange={(event) => $bold.set(event.currentTarget.checked)}
        />
        <Checkbox
            label="Italic"
            value={italic}
            onChange={(event) => $italic.set(event.currentTarget.checked)}
        />
        <Radio.Group
            value={reductionStrategy}
            onChange={(evt) => $reductionStrategy.set(evt as ReductionStrategy)}
            label="Reduction strategy"
            // description="Choose one of the following"
        >
            <Stack>
                <Radio value={ReductionStrategy.ADVANCED} label={"Advanced"}/>
                <Radio value={ReductionStrategy.SIMPLE} label={"Simple"}/>
                <Radio value={ReductionStrategy.NONE} label={"None"}/>
            </Stack>
        </Radio.Group>
        <Button onClick={onGenerate} disabled={!cvLoaded || mesh.length > 0}>Generate</Button>
        <Button onClick={downloadMesh} disabled={mesh.length === 0}>Download</Button>
    </Stack>
}

export default FormGenerate;