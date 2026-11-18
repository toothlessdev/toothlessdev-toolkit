/**
 * CSS 애니메이션이나 Web Animations API 로 움직이는 덱용 어댑터 예시입니다.
 * 슬라이드 요소의 애니메이션을 멈춘 뒤 currentTime 을 직접 맞춥니다.
 * 슬라이드 표시 방식(.active 클래스)과 선택자는 덱 코드를 읽어 바꿉니다.
 */
(() => {
    const slideElements = [...document.querySelectorAll(".slide")];

    window.talkieAdapter = {
        slideCount: slideElements.length,
        ownsDocumentAnimations: true,
        hideSelectors: [".deck-nav"],

        showSlide(slideIndex) {
            slideElements.forEach((element, index) => element.classList.toggle("active", index === slideIndex));
        },

        seekMotion(slideIndex, motionElapsedByName, { localSeconds }) {
            for (const animation of slideElements[slideIndex].getAnimations({ subtree: true })) {
                animation.pause();
                animation.currentTime = localSeconds * 1000;
            }
        },
    };
})();
