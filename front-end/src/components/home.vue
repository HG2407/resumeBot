<template>
    <div class="container">
        <div class="displayBox" ref="displayBox">
            <div v-for="number in storedMessages.length" :key="number"> 
                <p>{{ storedMessages[number-1].text || storedMessages[number-1] }}</p>
                <p @click="show" v-if="storedMessages[number-1].text" style="margin-top: -0.5rem; cursor:pointer;">show docs</p>
                <div v-if="showDetails">
                    <p v-for="document in storedMessages[number-1].sourceDocuments" :key="document" style="font-size: 0.8rem; margin-bottom: 0.5rem;">{{ document.pageContent}}</p>
                    <p v-for="document in storedMessages[number-1].sourceDocuments" :key="document"  style="font-size: 0.8rem; margin-top: 0rem; opacity: 0.6;" ref="details"> {{ document.metadata }}</p>
                </div>
            </div>
        </div>
        <p v-if="wait" class="wait">Please Wait...</p>
        <input type="text" @keydown.enter="send" v-model="userInput" placeholder="ask a question">
        <button @click="upload">upload</button>
    </div>
</template>

<script>
import axios from 'axios';
    export default {
        // eslint-disable-next-line vue/multi-word-component-names
        name: 'Home',
        data() {
            return {
                userInput: '',
                storedMessages: [],
                wait: false,
                enterClicked: false,
                showDetails: false
            }  
        },

        methods: {
            async upload() {
                if(!this.enterClicked) {
                    this.wait = true;
                    this.enterClicked = true;
                    let response = await axios.get('/uploadPDF');
                    console.log(response.data);
                    this.wait = false;
                    this.enterClicked = false;
                }
            },

            async send() {
                if(!this.enterClicked) {
                    this.wait = true;
                    this.storedMessages.push(this.userInput);
                    this.$nextTick(() => {
                        this.$refs['displayBox'].scrollTop = this.$refs['displayBox'].scrollHeight;
                    })
                    this.userInput = '';
                    let response = await axios.post('/answer', {
                        input: this.storedMessages[this.storedMessages.length-1]
                    });
                    console.log(response.data);
                    this.storedMessages.push(response.data);

                    this.$nextTick(() => {
                        this.$refs['displayBox'].scrollTop = this.$refs['displayBox'].scrollHeight;
                    })

                    response.data.sourceDocuments.forEach((document) => {
                        let string = document.pageContent;

                        let formattedString = string.replace(/\/n/g, '\n');
                        document.pageContent = formattedString;
                    });

                    this.wait = false;
                }
                
            },

            show() {
                this.showDetails = !this.showDetails;
                this.$nextTick(() => {
                    this.$refs['details'].scrollTop = this.$refs['details'].scrollHeight;
                })
            }
            
        }
    }
</script>


<style>
    .container {
        display: inline-block;
        width: 25.2rem;
        height: 35rem;
        border: 0.1rem solid black;
    }

    .displayBox {
        width: 25rem;
        height: 33rem;
        background-color: gainsboro;
        overflow-y: scroll;
    }

    ::-webkit-scrollbar {
        width: 0;
    }

    .displayBox p {
        text-align: left;
        padding: 0 1rem;
        overflow-wrap: break-word;
    }

    input {
        width: 100%;
        height: 2rem;
    }

    .wait {
        position: absolute;
        bottom: 3%;
        right: 46%;
    }

</style>