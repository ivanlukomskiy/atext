import {useState} from "react";
import {Button, Stack, TextInput} from "@mantine/core";

const defaultSideA = "SAMPLE";
const defaultSideB = "TEXT";

function FormGenerate() {
    const [sideAText, setSideAText] = useState(defaultSideA);
    const [sideBText, setSideBText] = useState(defaultSideB);
    return <Stack>
        {/*<Title>set text</Title>*/}
        <TextInput
            label="side a"
            placeholder="left side text"
            defaultValue="SAMPLE"
            onChange={(event) => setSideAText(event.currentTarget.value)}
        />
        <TextInput
            label="side b"
            placeholder="right side text"
            defaultValue="TEXT"
            onChange={(event) => setSideBText(event.currentTarget.value)}
        />
        <Button>Generate</Button>
    </Stack>
}

export default FormGenerate;