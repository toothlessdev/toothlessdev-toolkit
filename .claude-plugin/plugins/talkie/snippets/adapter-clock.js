/**
 * 시계 값(clock)으로 화면을 그리는 덱용 어댑터 예시입니다.
 * 덱의 전역 함수와 변수 이름은 덱마다 다릅니다. 이름을 그대로 쓰지 말고 덱 코드를 읽어 바꿉니다.
 *
 * 쌓이는 상태는 isDiscontinuous 일 때 지우고 다시 그립니다.
 *   - 그려진 결과를 쌓는 경우: 전부 지운 뒤 현재 시각까지 다시 그립니다.
 *   - 이전 단계 값과 비교해 건너뛰는 경우: 비교 값을 초기화합니다.
 *   - 슬라이드 사이를 날아가는 연출: 연속 재생일 때만 실행하고, 점프 때는 복제 요소를 지웁니다.
 */
(() => {
    function stopDeckClock() {
        cancelAnimationFrame(frameId);
        running = true;
        stage.classList.remove("motion-paused");
    }

    window.talkieAdapter = {
        slideCount: slides.length,
        hideSelectors: [".bottom", ".top", "[data-play]", "[data-replay]"],
        interactiveSelector: "img.zoomable",

        showSlide(slideIndex, { isDiscontinuous }) {
            document.querySelectorAll(".flying-card").forEach((element) => element.remove());
            if (isDiscontinuous) {
                current = slideIndex;
                render();
            } else {
                go(slideIndex);
            }
            stopDeckClock();
        },

        seekMotion(slideIndex, motionElapsedByName, { isDiscontinuous }) {
            const motionName = slides[slideIndex].motion;
            if (!motionName) return;

            const elapsedSeconds = motionElapsedByName[motionName];
            if (isDiscontinuous) traceIndex = -2;

            clock = elapsedSeconds ?? 0;
            paintMotion();
        },
    };
})();
