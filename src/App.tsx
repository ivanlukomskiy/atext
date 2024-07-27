import './App.css'
import {Button, createTheme, MantineProvider, Stack, TextInput} from '@mantine/core';
import '@mantine/core/styles.css';
import {useEffect, useState} from "react";
import {loadOpenCV} from "./scripts/opencv.ts";

const theme = createTheme({});

function App() {
    const [cvLoaded, setCvLoaded] = useState(false);


    useEffect(() => {
        loadOpenCV(() => {
            setCvLoaded(true);
        });
    }, []);

    return (
        <MantineProvider theme={theme} defaultColorScheme="dark">

        </MantineProvider>
    )
}

export default App
