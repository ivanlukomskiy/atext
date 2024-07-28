import {Button, Select, Stack, TextInput} from "@mantine/core";
import {useStore} from "@nanostores/react";
import {$font, $textA, $textB} from "../../store.ts";
import {useCallback} from "react";

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

    const onFont = useCallback((option: string | null) => {
        if (option !== null ) {
            $font.set(option)
        }
    }, [])

    return <Stack>
        <Select
            label="Font"
            placeholder="Pick value"
            data={defaultFonts}
            value={font}
            onChange={onFont}
        />
        <TextInput
            label="side a text"
            placeholder="right side text"
            value={textB}
            onChange={(event) => $textB.set(event.currentTarget.value)}
            styles={(theme) => ({
                input: {
                    fontFamily: font, // Replace with your desired font
                },
            })}
        />
        <TextInput
            label="side b text"
            placeholder="left side text"
            value={textA}
            onChange={(event) => $textA.set(event.currentTarget.value)}
            styles={(theme) => ({
                input: {
                    fontFamily: font, // Replace with your desired font
                },
            })}
        />
        <Button onClick={onGenerate}>Generate</Button>
    </Stack>
}

export default FormGenerate;