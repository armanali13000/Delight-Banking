import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMobile, profileComplete } from "../server/_lib/studentProfiles.js";

test("normalizes Indian mobile numbers to E.164",()=>{assert.equal(normalizeMobile("+91","98765 43210"),"+919876543210");assert.equal(normalizeMobile("+91","+919876543210"),"+919876543210")});
test("rejects malformed mobile numbers",()=>{assert.throws(()=>normalizeMobile("+91","98abc43210"),/valid mobile/);assert.throws(()=>normalizeMobile("+91","12345"),/10 digits/)});
test("requires both name and mobile for profile completion",()=>{assert.equal(profileComplete({fullName:"Student Name",mobile:"+919876543210"}),true);assert.equal(profileComplete({fullName:"Student Name"}),false);assert.equal(profileComplete({mobile:"+919876543210"}),false)});