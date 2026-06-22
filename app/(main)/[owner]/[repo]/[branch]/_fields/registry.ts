import { Field } from "@/types/field";
import { z } from "zod";
import * as booleanField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/boolean";
import * as codeField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/code";
import * as dateField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/date";
import * as fileField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/file";
import * as imageField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/image";
import * as numberField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/number";
import * as referenceField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/reference";
import * as richTextField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/rich-text";
import * as selectField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/select";
import * as stringField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/string";
import * as textField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/text";
import * as uuidField from "@/app/(main)/[owner]/[repo]/[branch]/_fields/core/uuid";

export type FieldCodec = {
  label?: string;
  schema?: (...args: any[]) => z.ZodTypeAny;
  defaultValue?: any;
  read?: (...args: any[]) => any;
  write?: (...args: any[]) => any;
  EditComponent?: React.ComponentType<any>;
  ViewComponent?: React.ComponentType<any>;
};

const codecMap = new Map<string, FieldCodec>();

const registerField = (fieldName: string, fieldModule: FieldCodec) => {
  codecMap.set(fieldName, fieldModule);
};

registerField("boolean", booleanField);
registerField("code", codeField);
registerField("date", dateField);
registerField("file", fileField);
registerField("image", imageField);
registerField("number", numberField);
registerField("reference", referenceField);
registerField("rich-text", richTextField);
registerField("select", selectField);
registerField("string", stringField);
registerField("text", textField);
registerField("uuid", uuidField);

export const getCodec = (type: string): FieldCodec | undefined => codecMap.get(type);
