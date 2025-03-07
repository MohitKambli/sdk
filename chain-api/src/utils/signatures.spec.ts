/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import BN from "bn.js";
import { ec as EC } from "elliptic";

import signatures from "./signatures";

describe("getPayloadToSign", () => {
  it("should sort keys", () => {
    // Given
    const obj = { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 };

    // When
    const toSign = signatures.getPayloadToSign(obj);

    // Then
    expect(toSign).toEqual('{"a":3,"b":[{"x":4,"y":5,"z":6},7],"c":8}');
  });

  it("should ignore 'signature' and 'trace' fields", () => {
    // Given
    const obj = { c: 8, signature: "to-be-ignored", trace: 3 };

    // When
    const toSign = signatures.getPayloadToSign(obj);

    // Then
    expect(toSign).toEqual('{"c":8}');
  });
});

describe("ethAddress", () => {
  it("should calculate eth address from public key", () => {
    // Given
    const key =
      "04a6eea22483bc0c512f3d3ce3ed9448aeba66ea353f0a832e3dd5d17fac38ee8149ae6e13ef5b2e37b1ed5fd23f7b23e07ecad9b70f9f01a0d852f702ff6f668a";
    const expectedAddr = "Af76AE5df7E92903043Aac92c8Af43C9806c44f2";

    // When
    const addr = signatures.getEthAddress(key);

    // Then
    expect(addr).toEqual(expectedAddr);
  });
});

describe("public key", () => {
  // https://privatekeys.pw/key/313871326028141e0bdeef59fe32a6fc51bce449e44907c191558cb6fdca1341#public
  const nonCompact =
    "04651b1e822f794444fbc96424da6b3536e725c92dbe0047f357cec15fbe5ff148ef0d0d37affaf4ee1d6d0da680bdbd177240913353c6792a60be6ddfb1ce25fb";
  const compact = "03651b1e822f794444fbc96424da6b3536e725c92dbe0047f357cec15fbe5ff148";
  const normalized = "A2UbHoIveURE+8lkJNprNTbnJcktvgBH81fOwV++X/FI";

  // Legacy - on prod we keep all public keys as compact base64
  it("should normalize public key", () => {
    // When
    const normalizedKey = signatures.normalizePublicKey(nonCompact).toString("base64");

    // Then
    expect(normalizedKey).toEqual(normalized);
  });

  it("should get public key from hex compact", () => {
    // When
    const normalizedKey = signatures.getCompactBase64PublicKey(compact);

    // Then
    expect(normalizedKey).toEqual(normalized);
  });

  it("should get public key from base64 compact", () => {
    // When
    const normalizedKey = signatures.getCompactBase64PublicKey(normalized);

    // Then
    expect(normalizedKey).toEqual(normalized);
  });
});

describe("signatures", () => {
  // see: https://privatekeys.pw/key/3b19099e96dccf44e1dfc13c89c7e490d902a96b0791faf185e194ae0e71786d
  const privateKey = "3b19099e96dccf44e1dfc13c89c7e490d902a96b0791faf185e194ae0e71786d";
  const publicKey =
    "04fa7d9e30902207fd821a1518ce777e1935a45e52180d6a6339f37c3e3f759d1a64e33ed1e334070d37731f6ce3f4a5daa6ee4c9884f21860601fed892d40b2a9";
  const publicKeyCompact = "03fa7d9e30902207fd821a1518ce777e1935a45e52180d6a6339f37c3e3f759d1a";
  const ethAddress = "28C6eB52a018CD3fc34dfbcBFF06Af1f9952Ab6E";

  const payload = { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 };
  const keccak = "79dd0efca18dd25aecc5aa5b5c6e89c1ea0ba96a04280cb7cb9a617e771d702b";

  const signature =
    "b7244d62671319583ea8f30c8ef3b343cf28e7b7bd56e32b21a5920752dc95b94a9d202b2919581bcf776f0637462cb67170828ddbcc1ea63505f6a211f9ac5b1b";
  const derSignature =
    "3045022100b7244d62671319583ea8f30c8ef3b343cf28e7b7bd56e32b21a5920752dc95b902204a9d202b2919581bcf776f0637462cb67170828ddbcc1ea63505f6a211f9ac5b";

  it("should explain the origin of pre-defined constants", () => {
    const pkObj = new EC("secp256k1").keyFromPrivate(privateKey, "hex");
    expect(pkObj.getPublic().encode("hex", false).toString()).toEqual(publicKey);
    expect(pkObj.getPublic().encode("hex", true).toString()).toEqual(publicKeyCompact);

    const pkKeccak = signatures.calculateKeccak256(Buffer.from(publicKey.slice(2), "hex"));
    expect(pkKeccak.toString("hex")).toEqual(
      "908004370d2800147b38cf7628c6eb52a018cd3fc34dfbcbff06af1f9952ab6e"
    );
    expect(pkKeccak.slice(-20).toString("hex")).toEqual(ethAddress.toLowerCase());

    const payloadBuffer = Buffer.from(signatures.getPayloadToSign(payload));
    expect(signatures.calculateKeccak256(payloadBuffer).toString("hex")).toEqual(keccak);
  });

  it("should get signature", async () => {
    // Given
    const privateKeyBuffer = Buffer.from(privateKey, "hex");

    // When
    const actualSignature = signatures.getSignature(payload, privateKeyBuffer);

    // Then
    expect(actualSignature).toEqual(signature);
  });

  it("should get DER signature", async () => {
    // Given
    const privateKeyBuffer = Buffer.from(privateKey, "hex");

    // When
    const actualSignature = signatures.getDERSignature(payload, privateKeyBuffer);

    // Then
    expect(actualSignature).toEqual(derSignature);
  });

  it("should normalize signature", async () => {
    // When
    const normalized = signatures.normalizeSecp256k1Signature(signature);

    // Then
    expect(normalized).toEqual({
      r: new BN("b7244d62671319583ea8f30c8ef3b343cf28e7b7bd56e32b21a5920752dc95b9", "hex"),
      s: new BN("4a9d202b2919581bcf776f0637462cb67170828ddbcc1ea63505f6a211f9ac5b", "hex"),
      recoveryParam: 0
    });
  });

  it("should normalize DER signature", async () => {
    // When
    const normalized = signatures.normalizeSecp256k1Signature(derSignature);

    // Then
    expect(normalized).toEqual({
      r: new BN("b7244d62671319583ea8f30c8ef3b343cf28e7b7bd56e32b21a5920752dc95b9", "hex"),
      s: new BN("4a9d202b2919581bcf776f0637462cb67170828ddbcc1ea63505f6a211f9ac5b", "hex"),
      recoveryParam: undefined
    });
  });

  it("should verify signature", async () => {
    // When
    const actual = signatures.isValid(signature, payload, publicKey);

    // Then
    expect(actual).toEqual(true);
  });

  it("should fail to verify signature (invalid payload)", async () => {
    // Given
    const invalidPayload = { ...payload, c: 9 };

    // When
    const actual = signatures.isValid(signature, invalidPayload, publicKey);

    // Then
    expect(actual).toEqual(false);
  });

  it("should fail to verify signature (invalid signature)", async () => {
    // Given
    const invalidSignature = "aa" + signature.substring(2, signature.length);

    // When
    const actual = signatures.isValid(invalidSignature, payload, publicKey);

    // Then
    expect(actual).toEqual(false);
  });

  it("should fail to verify signature (invalid public key)", async () => {
    // Given
    const invalidPublicKey = publicKey.substring(0, publicKey.length - 2) + "00";

    // When
    const actual = signatures.isValid(signature, payload, invalidPublicKey);

    // Then
    expect(actual).toEqual(false);
  });

  it("should verify signature with compact public key", async () => {
    // When
    const actual = signatures.isValid(signature, payload, publicKeyCompact);

    // Then
    expect(actual).toEqual(true);
  });

  it("should verify DER signature", async () => {
    // When
    const actual = signatures.isValid(derSignature, payload, publicKey);

    // Then
    expect(actual).toEqual(true);
  });

  it("should recover public key from signature", async () => {
    // When
    const actual = signatures.recoverPublicKey(signature, payload);

    // Then
    expect(actual).toEqual(publicKey);
  });

  it("should fail to recover public key from DER signature", async () => {
    // When
    const actual = new Promise((res) => res(signatures.recoverPublicKey(derSignature, payload)));

    // Then
    await expect(actual).rejects.toThrowError(/Signature must contain recovery part/);
  });

  it("Test multiple formats for each der signature length", async () => {
    // when
    const derSignatures = [
      // der138Signature
      "3043022030ef238065ff606bcb59ce9b40923bb1f86777056eabbf77ecbefd101d207fbd021f14d3aed3bf7e07cb3bf2ef2c06cfde6db461eea8f58827df5b0fa4185d6535",
      // der140signature
      "304402205139bc0c17ffef0056b4f22c4f0feb577e02d484d03087d5daba8551d30c99d702207700e118778e264c975731606bc9aecd440ae8e0a4a7b1b3bd51820e8cc0da29",
      // der142Signature
      "3045022100b7244d62671319583ea8f30c8ef3b343cf28e7b7bd56e32b21a5920752dc95b902204a9d202b2919581bcf776f0637462cb67170828ddbcc1ea63505f6a211f9ac5b",
      // der144Signature
      "3045022100f6d3aefb132b74e879a937dc6a28003d6c2acee6e27291bfb24834aa2cd2a610022003a06b8f150ab71b3e19621114f98416417bea4fbc5b3b4a30b610fea9f281e1"
    ];

    const testMultipleFormats = (dersignature: string) => {
      // normalize der signature to generate standard format
      const normalizedSig = signatures.normalizeSecp256k1Signature(dersignature);
      delete normalizedSig.recoveryParam;
      const { r, s } = normalizedSig;
      const standardHex = r.toString("hex", 32) + s.toString("hex", 32) + "1c";

      const sigDict = {
        // der format
        dersignature,
        base64Der: Buffer.from(dersignature, "hex").toString("base64"),
        prefixDer: `0x${dersignature}`,
        // standard format
        standardHex,
        base64StandardHex: Buffer.from(standardHex, "hex").toString("base64"),
        prefixHex: `0x${standardHex}`
      };

      for (const [, value] of Object.entries(sigDict)) {
        const derivedSig = signatures.normalizeSecp256k1Signature(value);
        delete derivedSig.recoveryParam;
        expect(derivedSig).toEqual(normalizedSig);
      }
    };

    for (const val of derSignatures) {
      testMultipleFormats(val);
    }

    // test old failure case:
    const shortSig = signatures.normalizeSecp256k1Signature(
      "MEMCIDDvI4Bl/2Bry1nOm0CSO7H4Z3cFbqu/d+y+/RAdIH+9Ah8U067Tv34Hyzvy7ywGz95ttGHuqPWIJ99bD6QYXWU1"
    );

    expect(shortSig).toEqual({
      r: new BN("30ef238065ff606bcb59ce9b40923bb1f86777056eabbf77ecbefd101d207fbd", "hex"),
      recoveryParam: undefined,
      s: new BN("14d3aed3bf7e07cb3bf2ef2c06cfde6db461eea8f58827df5b0fa4185d6535", "hex")
    });
  });
});
