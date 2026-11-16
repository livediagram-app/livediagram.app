// @vitest-environment jsdom
// @liveworkspace/capture: the sources, whether this browser can capture, the devices and their names, the level meter
// and the picker.
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_CONSTRAINTS, canCapture, MIC_CONSTRAINTS, onDevice } from './constraints';
import { listDevices, NO_DEVICES, useMediaDevices } from './devices';
import { DevicePicker, NO_CAMERA } from './DevicePicker';
import { levelMeter, meterFill, rmsOf } from './level';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sources', () => {
  it('asks for a picked device, else the default', () => {
    expect(onDevice(MIC_CONSTRAINTS, null)).toBe(MIC_CONSTRAINTS);
    expect(onDevice(MIC_CONSTRAINTS, 'm1').audio).toMatchObject({
      echoCancellation: true,
      deviceId: { exact: 'm1' },
    });
    expect(onDevice(CAMERA_CONSTRAINTS, 'c1').video).toMatchObject({ deviceId: { exact: 'c1' } });
    expect(onDevice({ audio: true }, 'm2').audio).toEqual({ deviceId: { exact: 'm2' } });
  });

  it('says whether this browser can capture each kind', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => undefined },
    });
    expect(canCapture('microphone')).toBe(true);
    expect(canCapture('camera')).toBe(true);
    expect(canCapture('screen')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(canCapture('camera')).toBe(false);
    vi.stubGlobal('isSecureContext', false);
    expect(canCapture('camera')).toBe(false);
  });
});

const info = (kind: MediaDeviceKind, deviceId: string, label = '') =>
  ({ kind, deviceId, label }) as MediaDeviceInfo;

describe('devices', () => {
  it('names each, before and after the browser allows names', async () => {
    const source = {
      enumerateDevices: async () => [
        info('audioinput', 'm1'),
        info('audioinput', 'm2', ' Desk Mic '),
        info('videoinput', 'c1'),
        info('audiooutput', 'o1'),
        info('videoinput', ''),
      ],
    };
    expect(await listDevices(source)).toEqual({
      microphones: [
        { id: 'm1', label: 'Microphone 1' },
        { id: 'm2', label: 'Desk Mic' },
      ],
      cameras: [{ id: 'c1', label: 'Camera 1' }],
    });
  });

  it('lists none where the browser cannot', async () => {
    expect(await listDevices(undefined)).toBe(NO_DEVICES);
    expect(await listDevices({ enumerateDevices: () => Promise.reject(new Error('no')) })).toBe(
      NO_DEVICES,
    );
  });

  it('keeps the list current while it is wanted', async () => {
    const target = new EventTarget();
    let mics = [info('audioinput', 'm1')];
    vi.stubGlobal('navigator', {
      mediaDevices: Object.assign(target, { enumerateDevices: async () => mics }),
    });
    const { result, rerender, unmount } = renderHook(({ on }) => useMediaDevices(on), {
      initialProps: { on: false },
    });
    expect(result.current).toBe(NO_DEVICES);
    rerender({ on: true });
    await act(async () => {});
    expect(result.current.microphones).toHaveLength(1);
    mics = [info('audioinput', 'm1'), info('audioinput', 'm2')];
    await act(async () => {
      target.dispatchEvent(new Event('devicechange'));
    });
    expect(result.current.microphones).toHaveLength(2);
    unmount();
  });

  it('drops an answer that lands after it is gone', async () => {
    let answer: (v: MediaDeviceInfo[]) => void = () => undefined;
    vi.stubGlobal('navigator', {
      mediaDevices: { enumerateDevices: () => new Promise((r) => (answer = r)) },
    });
    const { result, unmount } = renderHook(() => useMediaDevices(true));
    unmount();
    await act(async () => answer([info('audioinput', 'm1')]));
    expect(result.current).toBe(NO_DEVICES);
  });
});

describe('the level', () => {
  it('measures loudness as a fill', () => {
    expect(rmsOf(new Float32Array())).toBe(0);
    expect(rmsOf(new Float32Array([0.5, -0.5]))).toBe(0.5);
    expect(meterFill(0)).toBe(0);
    expect(meterFill(1)).toBe(1);
    expect(meterFill(0.01)).toBeCloseTo(0.25, 2);
  });

  it('reads a stream through an analyser and closes without stopping it', () => {
    const connect = vi.fn();
    const close = vi.fn(() => Promise.reject(new Error('closed')));
    const analyser = {
      fftSize: 0,
      getFloatTimeDomainData: (out: Float32Array) => out.fill(1),
    } as unknown as AnalyserNode;
    const meter = levelMeter({} as MediaStream, () => ({
      createAnalyser: () => analyser,
      createMediaStreamSource: () => ({ connect }) as unknown as MediaStreamAudioSourceNode,
      close,
    }));
    expect(connect).toHaveBeenCalledWith(analyser);
    expect(meter.read()).toBe(1);
    meter.close();
    expect(close).toHaveBeenCalled();
  });

  it('opens an AudioContext by default', () => {
    const made = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          made();
        }
        createAnalyser() {
          return { fftSize: 0, getFloatTimeDomainData: () => undefined };
        }
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        close() {
          return Promise.resolve();
        }
      },
    );
    levelMeter({} as MediaStream).close();
    expect(made).toHaveBeenCalled();
  });
});

describe('the picker', () => {
  const devices = {
    microphones: [{ id: 'm1', label: 'Desk Mic' }],
    cameras: [{ id: 'c1', label: 'FaceTime' }],
  };

  it('picks a microphone and a camera, or No Camera', () => {
    const onMicrophone = vi.fn();
    const onCamera = vi.fn();
    render(
      <DevicePicker
        devices={devices}
        microphone={null}
        camera={null}
        onMicrophone={onMicrophone}
        onCamera={onCamera}
      />,
    );
    fireEvent.change(screen.getByLabelText('Microphone'), { target: { value: 'm1' } });
    expect(onMicrophone).toHaveBeenLastCalledWith('m1');
    fireEvent.change(screen.getByLabelText('Microphone'), { target: { value: '' } });
    expect(onMicrophone).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: NO_CAMERA } });
    expect(onCamera).toHaveBeenLastCalledWith(NO_CAMERA);
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: '' } });
    expect(onCamera).toHaveBeenLastCalledWith(null);
  });

  it('shows the picked devices', () => {
    render(
      <DevicePicker
        devices={devices}
        microphone="m1"
        camera="c1"
        onMicrophone={() => undefined}
        onCamera={() => undefined}
      />,
    );
    expect((screen.getByLabelText('Camera') as HTMLSelectElement).value).toBe('c1');
    expect((screen.getByLabelText('Microphone') as HTMLSelectElement).value).toBe('m1');
  });

  it('says when there is nothing to pick, and can leave the camera out', () => {
    render(
      <DevicePicker
        devices={NO_DEVICES}
        microphone={null}
        camera={NO_CAMERA}
        onMicrophone={() => undefined}
        onCamera={() => undefined}
        withCamera={false}
      />,
    );
    expect((screen.getByLabelText('Microphone') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('No microphone found')).toBeTruthy();
    expect(screen.queryByLabelText('Camera')).toBeNull();
  });

  it('offers only No Camera when there is no camera', () => {
    render(
      <DevicePicker
        devices={NO_DEVICES}
        microphone={null}
        camera={NO_CAMERA}
        onMicrophone={() => undefined}
        onCamera={() => undefined}
      />,
    );
    const camera = screen.getByLabelText('Camera') as HTMLSelectElement;
    expect([...camera.options].map((o) => o.text)).toEqual(['No Camera']);
  });
});
