/** `<` 를 치환해서 작성자가 태그를 닫거나 새 태그를 열지 못하게 합니다. */
export function neutralizeExternalText(text: string): string {
    return text.replaceAll("<", "&lt;");
}
