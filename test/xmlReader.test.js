const XmlReader = require("../src/XmlReader");
const through2 = require("through2");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert");

async function parseWithStream(data, splitOn) {
    return new Promise((resolve, reject) => {
        const readers = [];
        XmlReader.streamParseFromString(data, splitOn)
            .on("end", () => resolve(readers))
            .on("error", (err) => reject(err))
            .pipe(
                through2.obj((chunk, _enc, next) => {
                    readers.push(chunk);
                    next();
                }),
            );
    });
}

const testData1 = `
<document>
    <test hello="world">yo</test>
    <list>
        <otheritem>yoyo</otheritem>
        <item>
            <nestedlist>
                <nesteditem attr="attr1">1</nesteditem>
                <nesteditem attr="attr2">2</nesteditem>
            </nestedlist>
        </item>
        <item>
            <nestedlist>
                <nesteditem attr="attr3">3</nesteditem>
                <nesteditem attr="attr4">4</nesteditem>
            </nestedlist>
        </item>
    </list>
</document>
`;

describe("XmlReader", () => {
    it("should read+write+read sample file and give the same result", async () => {
        const data = fs.readFileSync(
            path.join(__dirname, "data/sample.xml"),
            "utf-8",
        );

        const reader = (await parseWithStream(data))[0];

        const xmlStr = reader.toString();

        const readerAgain = (await parseWithStream(xmlStr))[0];

        assert.deepEqual(reader.data, readerAgain.data);
    });

    it("should read+write+read sample file using xml2js and give the same result", async () => {
        const data = fs.readFileSync(
            path.join(__dirname, "data/sample.xml"),
            "utf-8",
        );

        const reader = await XmlReader.parse(data);

        const xmlStr = reader.toString();

        const readerAgain = await XmlReader.parse(xmlStr);

        assert.deepEqual(reader.data, readerAgain.data);
    });

    it("should read some basic things", async () => {
        const reader = await XmlReader.parse(testData1);

        assert.deepEqual(reader.attributeAt("test", "hello"), "world");

        assert.deepEqual(reader.valAt("list.item.nestedlist.nesteditem"), "1");

        assert.strictEqual(reader.has("list"), true);

        assert.strictEqual(reader.has("blarg"), false);

        assert.deepEqual(
            reader
                .asArray("list.item.nestedlist.nesteditem")
                .map((r) => r.val()),
            ["1", "2"],
        );

        assert.deepEqual(
            reader
                .asArray("list.item.nestedlist.nesteditem")
                .map((r) => r.attribute("attr")),
            ["attr1", "attr2"],
        );

        assert.deepEqual(
            reader
                .asArrayAll("list.item.nestedlist.nesteditem")
                .map((r) => r.val()),
            ["1", "2", "3", "4"],
        );
    });

    it("should parse some basic stuff by stream", async () => {
        const readers = await parseWithStream(testData1, "list.item");

        assert.strictEqual(readers[0].valAt("test"), "yo");

        assert.strictEqual(readers[0].valAt("list.otheritem"), "yoyo");

        assert.deepEqual(
            readers[0]
                .asArrayAll("list.item.nestedlist.nesteditem")
                .map((r) => r.val()),
            ["1", "2"],
        );

        assert.strictEqual(readers[1].valAt("test"), "yo");

        assert.strictEqual(readers[1].valAt("list.otheritem"), "yoyo");

        assert.deepEqual(
            readers[1]
                .asArrayAll("list.item.nestedlist.nesteditem")
                .map((r) => r.val()),
            ["3", "4"],
        );
    });
});
