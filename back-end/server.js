const express = require('express');
const app = express();
require('dotenv').config();
const {DirectoryLoader} = require('langchain/document_loaders/fs/directory');
const {PDFLoader} = require('langchain/document_loaders/fs/pdf');
const {CharacterTextSplitter} = require('langchain/text_splitter');
const {PineconeClient} = require('@pinecone-database/pinecone');
const {PineconeStore} = require('langchain/vectorstores/pinecone');
const {OpenAIEmbeddings} = require('langchain/embeddings/openai');
const {OpenAI} = require('langchain/llms/openai');
const {loadSummarizationChain, VectorDBQAChain} = require('langchain/chains');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const {PromptTemplate} = require('langchain/prompts');

app.use(express.json());

app.get('/uploadPDF', async (req,res) => {
    let loader = new DirectoryLoader('./resume', {
        '.pdf': (path) => {
           return new PDFLoader(path, '/pdf');
        }
    });

    let docs = await loader.load();

    let splitter = new CharacterTextSplitter({
        separator: ' ',
        chunkSize: 200,
        chunkOverlap: 20
    });

    let splittedDocs = await splitter.splitDocuments(docs);


    let reducedDocs = splittedDocs.map((doc) => {
        let fileName = doc.metadata.source.split('/').pop();

        let [_, firstName, lastName]= fileName.split('_');
        
        return {
            ...doc,
            metadata: {
                first_name: firstName,
                last_name: lastName.slice(0, -4),
                docType: 'resume',
                location: doc.metadata.loc 
            }
        }
    });

    let summaries = [];
    let model = new OpenAI({
        openAIApiKey:process.env.OPENAI_API_KEY,
        temperature: 0
    });

    let summarizeAllChain = loadSummarizationChain(model, {
        type: 'map_reduce'
    });

    let summarizeAllRes = await summarizeAllChain.call({
        input_documents: docs
    });

    summaries.push({summary: summarizeAllRes.text});

    for(let doc of docs) {
        let summarizeOneChain = loadSummarizationChain(model, {
            type:'map_reduce'
        });

        let summarizeOneRes = await summarizeOneChain.call({
            input_documents: [doc]
        });

        summaries.push({summary: summarizeOneRes.text});

    }

    let client = new PineconeClient();

    await client.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT
    });

    let pineconeIndex = client.Index(process.env.PINECONE_INDEX);

    await PineconeStore.fromDocuments(reducedDocs, new OpenAIEmbeddings(), {
        pineconeIndex
    });

    console.log('Uploaded to Pinecone!');

    let summaryStr = JSON.stringify(summaries, null, 2);
    console.log(summaryStr);
    res.json({summary: summaryStr});

})


app.post('/answer', async (req, res) => {
    let input = req.body.input;

    let client = new PineconeClient();

    await client.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT
    });

    let pineconeIndex = client.Index(process.env.PINECONE_INDEX);

    let vectorStore = await PineconeStore.fromExistingIndex(new OpenAIEmbeddings(), {
        pineconeIndex
    });

    let model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0.2
    });

    let chain = VectorDBQAChain.fromLLM(model, vectorStore, {
        k: 1,
        returnSourceDocuments: true
    });

    let promptTemplate = new PromptTemplate({
        template: 'Assume you are a Human Resource Manager. According to the resumes, answer the following question: {question}',
        inputVariables: ['question']
    });

    let formattedDocument = await promptTemplate.format({
        question: input
    });

    let response = await chain.call({
        query: formattedDocument
    });

    res.json(response);
})

app.listen(8000, () => {
    console.log('server is listening at port: 8000');
})